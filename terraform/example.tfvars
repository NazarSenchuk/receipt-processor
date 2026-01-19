processing_config= {
    email="email to receive emails(must be verified in ses)"
    openrouter_api_key="api key of openrouter"
    openrouter_model="allenai/molmo-2-8b:free , model  what will process images"


    #sometimes llm api can response so long  , you can adjust timeouts for lambdas
    injection_timeout = 40
    processing_timeout = 120

}
ui_config= {
    api_name = "example" # name of api gateway
    custom_domain = " "# custom domain , only route53
    custom_domain_zone = ""  #route53 zone id for custom domain


}
tags = {
    "app" : "Receipt-processor"
    "env" :  "test"
}
environment="test"
region="eu-north-1"