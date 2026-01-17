
resource "aws_sqs_queue" "shared_dlq" {
  name                      = "${var.environment}-shared-dlq"
  delay_seconds             = 0
  max_message_size          = 1048576
  message_retention_seconds = 1209600 
  tags = {
    App         = "Receipt-Processor"
    Environment = var.environment
    Type        = "DLQ"
  }
}

resource "aws_sqs_queue" "injection" {
  name                      = "${var.environment}-injection"
  delay_seconds             = 0
  max_message_size          = 1048576
  message_retention_seconds = 86400
  receive_wait_time_seconds = 0
  visibility_timeout_seconds = 20 
  redrive_policy = jsonencode({
        deadLetterTargetArn = aws_sqs_queue.shared_dlq.arn
        maxReceiveCount     = 2
    })

  tags = {
    App         = "Receipt-Processor"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "processing" {
  name                      = "${var.environment}-processing"
  delay_seconds             = 0
  max_message_size          = 1048576
  message_retention_seconds = 86400
  receive_wait_time_seconds = 0
  visibility_timeout_seconds = 100

  redrive_policy = jsonencode({
        deadLetterTargetArn = aws_sqs_queue.shared_dlq.arn
        maxReceiveCount     = 2
    })

  tags = {
    App         = "Receipt-Processor"
    Environment = var.environment
  }
}


resource "aws_sqs_queue_policy" "injection" {
  queue_url = aws_sqs_queue.injection.id
  policy    = data.aws_iam_policy_document.injection.json
}


resource "aws_lambda_event_source_mapping" "injection_queue_trigger" {
  event_source_arn = aws_sqs_queue.injection.arn
  function_name    = aws_lambda_function.injection.arn
  
  enabled          = true

  depends_on = [
    aws_lambda_function.injection
  ]
}


resource "aws_lambda_event_source_mapping" "processing_queue_trigger" {
  event_source_arn = aws_sqs_queue.processing.arn
  function_name    = aws_lambda_function.processing.arn
  
  enabled          = true

  depends_on = [
    aws_lambda_function.processing
  ]
}