output "bucket" {
    description  = "Frontend bucket with  static files"
    value = aws_s3_bucket.frontend_bucket.id
}
output "api_url" {
    description  = "URL of api gateway"
    value  = aws_api_gateway_stage.main.invoke_url
}

output "url" {
    description = "URL of frontend cloudfront distribution"
    value  = aws_cloudfront_distribution.frontend_distribution.domain_name
}