
# What it is
A very simple Node js script for whatsapp api using bailey, support multi session. 

Changelog 2-8-2024
The script now following restful API.
The socket will be close after one minutes no qr scan and shall be re-start-ed to be able to scan new QR.
The apikey management now have another apikey protection called system api key. it will be generated the first time script start and saved in system_api_key.json
openapi documentation now avalilable to be use with postman or swagger
adding ratelimiter for api call

# Installation
donwload or clone the files. run `yarn` and then `node app.js` the server will run in port 3000.
To change port simply edit app.js change `const port = 3000` to something else

# API
use openapi_doc.json in postman or swagger to see all available endpoint

# Example
see waapi.php for complete php function of all API endpoint.
