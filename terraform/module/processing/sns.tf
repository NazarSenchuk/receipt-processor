resource "aws_sns_topic" "main" {
  name = "${var.environment}-receipts"
  tags = {
    App         = "Receipt-Processor"
    Environment = var.environment
  }
}

resource "aws_sns_topic_policy" "receipts_email_policy" {
  arn = aws_sns_topic.main.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPublish"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.main.arn
      }
    ]
  })
}


resource "aws_sns_topic_subscription" "injection_subscription" {
  topic_arn = aws_sns_topic.main.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.injection.arn
  raw_message_delivery = true
}

