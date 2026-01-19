resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "receipts"
}
resource "aws_ses_active_receipt_rule_set" "receipts_active" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

resource "aws_ses_receipt_rule" "rule_1" {
  name          = "rule-1"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = [var.processing_config.email]
  enabled       = true
  scan_enabled  = false
  tls_policy    = "Optional"
  s3_action {
    bucket_name           = aws_s3_bucket.main.id
    object_key_prefix     = "inbox/"
    topic_arn            = aws_sns_topic.main.arn
    position             = 1
  }
  depends_on = [aws_ses_receipt_rule_set.main]
}

