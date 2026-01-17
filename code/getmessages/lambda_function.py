import json
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from decimal import Decimal
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB
table_name = os.environ.get('TABLE_NAME', 'receipts-table')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(table_name)

# Helper: convert Decimal to float for JSON
def decimal_to_float(obj):
    if isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj

# Helper: CORS response
def cors_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
            'Access-Control-Allow-Methods': 'GET,OPTIONS,POST,PUT,DELETE',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        },
        'body': json.dumps(body)
    }

# Main handler
def lambda_handler(event, context):
    logger.info("Event: %s", json.dumps(event))
    
    # Handle OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return cors_response(200, {})

    try:
        # Debug print for Cognito identity
        logger.info("RequestContext: %s", json.dumps(event.get('requestContext', {})))

        # Try to get email from Cognito authorizer claims
        email = None
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        if 'email' in claims:
            email = claims['email']
        elif 'cognito:email' in claims:
            email = claims['cognito:email']

        # Fallback: get email from query params
        if not email and event.get('queryStringParameters'):
            email = event['queryStringParameters'].get('email')

        if not email:
            return cors_response(400, {'error': 'Email is required or user must be authenticated'})

        logger.info(f"Querying messages for email: {email}")

        # Query DynamoDB using GSI 'email_from-index'
        response = table.query(
            IndexName='email_from-index',
            KeyConditionExpression=Key('email_from').eq(email),
            ScanIndexForward=False
        )

        items = decimal_to_float(response.get('Items', []))
        count = response.get('Count', 0)

        if count == 0:
            return cors_response(404, {
                'message': f'No messages found for email: {email}',
                'count': 0,
                'items': []
            })

        return cors_response(200, {
            'message': 'Messages retrieved successfully',
            'count': count,
            'items': items
        })

    except ClientError as e:
        logger.error(f"DynamoDB ClientError: {e.response['Error']['Message']}")
        return cors_response(500, {
            'error': 'Database error',
            'details': e.response['Error']['Message']
        })
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return cors_response(500, {
            'error': 'Internal server error',
            'details': str(e)
        })
