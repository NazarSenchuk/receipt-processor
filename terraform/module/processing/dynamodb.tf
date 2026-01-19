resource "aws_dynamodb_table" "main" {
  name           = "${var.environment}-receipts-table"
  billing_mode   = "PAY_PER_REQUEST"
  table_class    = "STANDARD"
  hash_key       = "receipt_id"

  attribute {
    name = "receipt_id"
    type = "S"
  }

  attribute {
    name = "email_from"
    type = "S"
  }

  attribute {
    name = "message_id"
    type = "S"
  }

  global_secondary_index {
    name            = "email_from-index"
    hash_key        = "email_from"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "message_id-index"
    hash_key        = "message_id"
    projection_type = "ALL"
  }

  tags = var.tags
}
