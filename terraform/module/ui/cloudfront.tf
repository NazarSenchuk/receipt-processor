
resource "aws_acm_certificate" "cloudfront_cert"{
  count  = var.ui_config.custom_domain != "" ? 1 : 0 

  domain_name= var.ui_config.custom_domain
  validation_method = "DNS"
  tags= var.tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.ui_config.custom_domain != "" ? {
    for dvo in aws_acm_certificate.cloudfront_cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.ui_config.custom_domain_zone 
}

resource "aws_acm_certificate_validation" "cert" {
  count = var.ui_config.custom_domain != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.cloudfront_cert[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}


resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.environment}-receipts-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always" 
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.environment}-receipts frontend distribution"


  aliases  = var.ui_config.custom_domain != "" ?  [var.ui_config.custom_domain] : []
  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend_hosting.website_endpoint
    origin_id   = "S3WebsiteOrigin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" 
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    
    target_origin_id = "S3WebsiteOrigin"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]

    forwarded_values {
      query_string = true

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  tags = var.tags
}



resource "aws_route53_record" "custom_domain"{
  count = var.ui_config.custom_domain  != "" ? 1 : 0
  zone_id = var.ui_config.custom_domain_zone
  name    = var.ui_config.custom_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.frontend_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}