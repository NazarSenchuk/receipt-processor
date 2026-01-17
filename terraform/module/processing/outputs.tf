output "email" {
    value = var.processing_config.email
    description = "Target email to send your receipts"
}
output "bucket" {
    value = aws_s3_bucket.main.id
    description = "Bucket that stores all files related to receipts"
}
output "table" {
    value = aws_dynamodb_table.main
    description = "Table that stores structured information about processed receipts"
}
output "lambda_injection" {
    value = aws_lambda_function.injection.arn
    description = "Lambda, responsible for injection receipts from emails"
}
output "lambda_processing" {
    value = aws_lambda_function.processing.arn
    description = "Lambda, responsible for processing receipts"
}

