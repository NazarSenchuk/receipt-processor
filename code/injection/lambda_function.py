import json
import boto3
import email
from email import policy
import os
import re
from email.utils import parseaddr

s3 = boto3.client('s3')
sqs = boto3.client('sqs')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'checker-main-12')
PROCESSING_QUEUE_URL = os.environ.get('PROCESSING_QUEUE_URL')


def parse_email_from(email_string):
    """
    Parse email from string into name and email address.
    
    Examples:
    - "John Doe <john@example.com>" -> ("John Doe", "john@example.com")
    - "john@example.com" -> ("", "john@example.com")
    - "Сенчук Назар <senchuknazar6@gmail.com>" -> ("Сенчук Назар", "senchuknazar6@gmail.com")
    - "\"John Doe\" <john@example.com>" -> ("John Doe", "john@example.com")
    """
    try:
        # Use email.utils.parseaddr for robust parsing
        name, email_address = parseaddr(email_string)
        
        # Clean up the name
        if name:
            # Remove quotes if present
            name = name.strip().strip('"').strip("'")
        
        # Ensure email is lowercase
        if email_address:
            email_address = email_address.lower()
        
        return name, email_address
    except Exception as e:
        print(f"Error parsing email from '{email_string}': {e}")
        # Fallback: try to extract email using regex
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', email_string)
        if email_match:
            return "", email_match.group(0).lower()
        return "", email_string

def lambda_handler(event, context):
    """
    Extract files from SQS message and inject them into S3
    Then send message to processing queue
    """
    
    for record in event['Records']:
        try:
            # Parse SQS message body
            body = json.loads(record['body'])
            
            # Extract message metadata
            message_id = body['mail']['messageId']
            object_key = body['receipt']['action']['objectKey']
            
            print(f"Processing message: {message_id}")
            print(f"S3 object key: {object_key}")
            
            # Download the raw email from S3
            response = s3.get_object(Bucket=BUCKET_NAME, Key=object_key)
            raw_email = response['Body'].read()
            
            # Parse email
            msg = email.message_from_bytes(raw_email, policy=policy.default)
            
            # Extract attachments
            attachments = []
            file_count = 0
            has_images = False
            
            for part in msg.walk():
                # Skip multipart containers
                if part.get_content_maintype() == 'multipart':
                    continue
                
                # Skip text/html/plain parts that are email body
                if part.get_content_type() in ['text/plain', 'text/html']:
                    continue
                
                # Get filename
                filename = part.get_filename()
                if filename:
                    # Get file content
                    file_data = part.get_payload(decode=True)
                    content_type = part.get_content_type()
                    
                    # Save to S3 in injected folder
                    target_key = f"injected/{message_id}/files/{filename}"
                    s3.put_object(
                        Bucket=BUCKET_NAME,
                        Key=target_key,
                        Body=file_data,
                        ContentType=content_type
                    )
                    
                    # Check if it's an image
                    if content_type.startswith('image/'):
                        has_images = True
                    
                    attachments.append({
                        'filename': filename,
                        's3_key': target_key,
                        'content_type': content_type,
                        'size': len(file_data)
                    })
                    
                    file_count += 1
                    print(f"Injected file: {filename} -> {target_key}")
            
            # Save metadata
            metadata = {
                'message_id': message_id,
                'from': body['mail']['commonHeaders']['from'],
                'to': body['mail']['commonHeaders']['to'],
                'subject': body['mail']['commonHeaders']['subject'],
                'timestamp': body['mail']['timestamp'],
                'attachments': attachments,
                'file_count': file_count,
                'has_images': has_images
            }
            
            metadata_key = f"injected/{message_id}/metadata.json"
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=metadata_key,
                Body=json.dumps(metadata, indent=2),
                ContentType='application/json'
            )
            
            print(f"Injection complete: {file_count} files processed")
            email_from_raw = body['mail']['commonHeaders']['from'][0]
            email_name, email_address = parse_email_from(email_from_raw)
            
            # Send to processing queue ONLY if there are images
            if has_images and PROCESSING_QUEUE_URL:
                processing_message = {
                    'message_id': message_id,
                    'file_count': file_count,
                    'has_images': has_images,
                    'email_from_raw': email_from_raw,  # Keep original for reference
                    'email_from': email_address,       # Parsed email address
                    'email_name': email_name,          # Parsed name
                    'email_subject': body['mail']['commonHeaders']['subject']
                }
                
                sqs.send_message(
                    QueueUrl=PROCESSING_QUEUE_URL,
                    MessageBody=json.dumps(processing_message),
                    MessageAttributes={
                        'message_id': {
                            'StringValue': message_id,
                            'DataType': 'String'
                        }
                    }
                )
                print(f"Sent to processing queue: {message_id}")
            else:
                print(f"No images found, skipping processing queue")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message_id': message_id,
                    'files_injected': file_count,
                    'has_images': has_images,
                    'sent_to_processing': has_images,
                    'attachments': attachments
                })
            }
            
        except Exception as e:
            print(f"Error processing record: {str(e)}")
            raise e
    
    return {
        'statusCode': 200,
        'body': json.dumps('Processing complete')
    }