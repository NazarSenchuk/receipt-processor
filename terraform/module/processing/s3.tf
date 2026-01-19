resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "main" {
  bucket = "${var.environment}-receipts-${random_id.bucket_suffix.hex}"
  tags = var.tags
}

resource "aws_s3_bucket_policy" "checker_main_policy" {
  bucket = aws_s3_bucket.main.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.main.arn}/*"
      },
      {
        Sid    = "AllowSESPutsBucketDelivery"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutBucketNotification"
        Resource = aws_s3_bucket.main.arn
      }
    ]
  })
}