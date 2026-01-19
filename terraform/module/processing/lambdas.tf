
resource "aws_lambda_function" "injection" {
    filename                       = "${path.module}/../../../code/injection/injection.zip"
    function_name                  = "${var.environment}-injection"
    role                           = aws_iam_role.injection.arn
    runtime                        = "python3.14"
    handler                        = "lambda_function.lambda_handler"

    environment {
      variables = {
        "PROCESSING_QUEUE_URL": aws_sqs_queue.processing.url 
        "BUCKET_NAME" : aws_s3_bucket.main.id 
        }
    }

    timeout = var.processing_config.injection_timeout
    tags = var.tags
}

resource "aws_lambda_function" "processing" {
    filename                       = "${path.module}/../../../code/processing/processing.zip"
    function_name                  = "${var.environment}-processing"
    role                           = aws_iam_role.processing.arn
    runtime                        = "python3.14"
    handler = "lambda_function.lambda_handler"
    environment {
      variables = {"BUCKET_NAME" : aws_s3_bucket.main.id,
                  "TABLE_NAME" : aws_dynamodb_table.main.name,
                  "OPENROUTER_API_KEY" : var.processing_config.openrouter_api_key ,
                  "OPENROUTER_MODEL": var.processing_config.openrouter_model, 
                  "SENDER_EMAIL" :  var.processing_config.sender_email
      }
    }
    timeout = var.processing_config.processing_timeout
    tags = var.tags
}