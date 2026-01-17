import json
import boto3
import os
import requests
import base64
from datetime import datetime
from decimal import Decimal

# Environment variables should be defined before using them
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'receipts@senchuknazar123.online')  # Missing equals sign
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'checker-main-12')
TABLE_NAME = os.environ.get('TABLE_NAME', 'receipts-table')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
OPENROUTER_MODEL = os.environ.get('OPENROUTER_MODEL', 'nvidia/nemotron-nano-12b-v2-vl:free')
CHARSET = "UTF-8"  # Missing CHARSET definition

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
ses_client = boto3.client('ses', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)

def extract_receipt_info(image_base64, filename):
    """
    Send image to OpenRouter for receipt analysis
    """
    headers = {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/your-repo',
        'X-Title': 'Receipt Processor'
    }
    
    payload = {
        'model': OPENROUTER_MODEL,
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': '''Extract receipt information and return ONLY JSON with this structure:
                        {
                          "merchant_name": "store name",
                          "date": "YYYY-MM-DD",
                          "time": "HH:MM",
                          "total_amount": 0.00,
                          "currency": "USD/EUR/etc",
                          "payment_method": "cash/card/etc"
                        }
                        No explanations, no markdown, just pure JSON.'''
                    },
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': f'data:image/png;base64,{image_base64}'
                        }
                    }
                ]
            }
        ],
        'max_tokens': 500,
        'temperature': 0.1
    }
    
    try:
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=60
        )
        
        print(f"OpenRouter Status Code: {response.status_code}")
        print(f"OpenRouter Response: {response.text[:200]}")
        
        response.raise_for_status()
        result = response.json()
        
        # Check for API errors first
        if 'error' in result:
            print(f"OpenRouter API error: {result['error']}")
            return None
            
        # Check if choices exists
        if 'choices' not in result or not result['choices']:
            print(f"No choices in response: {result}")
            return None
            
        content = result['choices'][0]['message']['content']
        
        # Clean the response
        content_clean = content.strip()
        
        # Remove code blocks if present
        if '```json' in content_clean:
            content_clean = content_clean.split('```json')[1]
        if '```' in content_clean:
            content_clean = content_clean.split('```')[0]
            
        content_clean = content_clean.strip()
        
        # Parse JSON
        receipt_data = json.loads(content_clean)
        return receipt_data
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {str(e)}")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {str(e)}")
        if 'content' in locals():
            print(f"Raw content: {content[:500]}")
        return None
    except KeyError as e:
        print(f"Key error in response: {str(e)}")
        print(f"Response structure: {result}")
        return None
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return None

def convert_floats_to_decimal(obj):
    """Convert floats to Decimal for DynamoDB"""
    if isinstance(obj, list):
        return [convert_floats_to_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    return obj

def send_email(receipt_id, file_name, email_from):
    """Send email notification"""
    BODY_HTML = f"""<html>
    <head></head>
    <body>
    <h1>Receipt Processor Message</h1>
    <p>Your receipt {receipt_id} with file {file_name} has been completely processed. Visit site to check analytics.</p>
    </body>
    </html>
    """
    
    try:
        response = ses_client.send_email(
            Destination={
                'ToAddresses': [email_from],
            },
            Message={
                'Body': {
                    'Html': {
                        'Charset': CHARSET,
                        'Data': BODY_HTML,
                    },
                },
                'Subject': {
                    'Charset': CHARSET,
                    'Data': "Processed receipt",
                },
            },
            Source=SENDER_EMAIL,
        )
        print(f"Email sent! Message ID: {response['MessageId']}")
        print(f"Sent email to {email_from}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")

def lambda_handler(event, context):
    """
    Process receipt files from /injected/{message_id}/files/
    Send to OpenRouter for analysis
    Save results to DynamoDB
    """
    
    for record in event.get("Records", []):
        try:
            # 1️⃣ Parse body
            try:
                body = json.loads(record["body"])
            except (KeyError, json.JSONDecodeError):
                print("Invalid SQS message body")
                continue

            message_id = body.get("message_id")
            file_count = body.get("file_count")
            has_images = body.get("has_images")
            email_from_raw = body.get("email_from_raw", body.get("email_from"))
            email_from = body.get("email_from")
            email_name = body.get("email_name")
            email_subject = body.get("email_subject")

            # 2️⃣ Fallback to messageAttributes (optional but safe)
            if not message_id:
                attrs = record.get("messageAttributes", {})
                if "message_id" in attrs:
                    message_id = attrs["message_id"]["stringValue"]

            # 3️⃣ Validate
            if not message_id:
                print("message_id not found, skipping message")
                continue

            print(f"Processing message {message_id}")
            print(f"Files: {file_count}, Images: {has_images}")
            print(f"From: {email_from}, Subject: {email_subject}")
            
            # Load metadata
            metadata_key = f"injected/{message_id}/metadata.json"
            metadata_obj = s3.get_object(Bucket=BUCKET_NAME, Key=metadata_key)
            metadata = json.loads(metadata_obj['Body'].read())
            
            results = []
            
            # Process each file
            for attachment in metadata['attachments']:
                filename = attachment['filename']
                s3_key = attachment['s3_key']
                content_type = attachment['content_type']
                
                print(f"Processing file: {filename}")
                
                # Only process images
                if not content_type.startswith('image/'):
                    print(f"Skipping non-image file: {filename}")
                    continue
                
                # Download file from S3
                file_obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
                file_data = file_obj['Body'].read()
                
                # Convert to base64
                image_base64 = base64.b64encode(file_data).decode('utf-8')
                
                # Send to OpenRouter
                receipt_info = extract_receipt_info(image_base64, filename)
                
                if receipt_info:
                    # Prepare DynamoDB item
                    receipt_id = f"{message_id}_{filename}"
                    
                    item = {
                        'receipt_id': receipt_id,
                        'message_id': message_id,
                        'filename': filename,
                        's3_key': s3_key,
                        'content_type': content_type,
                        'file_size': len(file_data),
                        'email_from_raw': email_from_raw,
                        'email_from': email_from,
                        'email_name': email_name,
                        'email_subject': email_subject,
                        'processed_at': datetime.utcnow().isoformat() + "Z",
                        'receipt_data': convert_floats_to_decimal(receipt_info),
                        'status': 'processed',
                        'processing_timestamp': datetime.utcnow().isoformat() + "Z"
                    }
                    
                    # Save to DynamoDB
                    table.put_item(Item=item)
                    
                    results.append({
                        'filename': filename,
                        'receipt_id': receipt_id,
                        'status': 'success',
                        'data': receipt_info
                    })
                    
                    print(f"Saved to DynamoDB: {receipt_id}")
                    
                    # Send email notification
                    send_email(receipt_id, filename, email_from)
                    
                else:
                    results.append({
                        'filename': filename,
                        'status': 'failed',
                        'error': 'Failed to extract receipt info'
                    })
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message_id': message_id,
                    'processed_files': len(results),
                    'results': results
                }, default=str)
            }
            
        except Exception as e:
            print(f"Error processing record: {str(e)}")
            continue
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Processing completed',
            'processed_records': len(event.get("Records", []))
        })
    }