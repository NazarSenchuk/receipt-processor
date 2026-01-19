resource "aws_cognito_user_pool" "main" {
  name = "${var.environment}-receipts"
  username_attributes = ["email"]
  password_policy{
    require_symbols = false
    minimum_length = 6

  }
  auto_verified_attributes = ["email"]
  tags = var.tags
}


resource "aws_cognito_user_pool_client" "web_client" {
  name = "${var.environment}-receipts-web-client"
  user_pool_id = aws_cognito_user_pool.main.id
  generate_secret = false

  callback_urls = compact([
    "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}",
    var.ui_config.custom_domain != "" ? "https://${var.ui_config.custom_domain}": null,
    "http://localhost:8080",
  ])
  logout_urls = compact([
    "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}",
    var.ui_config.custom_domain != "" ? "https://${var.ui_config.custom_domain}": null,
     "http://localhost:8080"
  ])

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = ["email", "openid", "aws.cognito.signin.user.admin"]

  supported_identity_providers = ["COGNITO"]

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}