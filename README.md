
# What it is
A very simple Node js script for whatsapp api using bailey, support multi session. 


# Installation
donwload or clone the files. run `yarn` and then `node app.js` the server will run in port 3000.
To change port simply edit app.js change `const port = 3000` to something else


# API
**APIKEY** 
Apikey related only able to be executed from localhost

**Generate api key for session id**

	post http://localhost:3000/genapi/sessionid
    will return => 'x-api-key'

**Get api key for session id**

    get http://localhost:3000/getapi/sessionId
    
**Delete api key for session id**

    get http://localhost:3000/delapi/sessionId
 
 ==============================

**Start socket for a session :**

    get http://localhost:3000/start/sessionId
    header => 'x-api-key'
Replace sessionId with unique session. You should start socket for each session to make each sessionId work.

**Check socket status for a session :**

    get http://localhost:3000/socketstat/sessionId
    header => 'x-api-key'
    
**Generate QR-Code :**

    get http://localhost:3000/getqr/sessionId
    header => 'x-api-key'
    
**Check no on whatsapp :**

    get http://localhost:3000/checkno/sessionId/phonenumberwithcountrycode
    header => 'x-api-key'

**Send Message**

    post http://localhost:3000/message/sessionid
    header => 'x-api-key'
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => message content
    
**Send image via url**

    post http://localhost:3000/sendimageurl/sessionid
    header => 'x-api-key'
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => caption
    attachment => image url
    
**Send files via url**

    post http://localhost:3000/sendfileurl/sessionid
    header => 'x-api-key'
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => caption
    attachment => file url
    filename => file name include file format


# Webhook
The script support simple webhook to return incoming message and sender number.

**Set webhook for session id**

    post http://localhost:3000/set-webhook/sessionid
    header => 'x-api-key'
    body:
    webhookUrl => webhook url

**Check webhook url already setup for a sessionid**

    get http://localhost:3000/get-webhook/sessionId
    header => 'x-api-key'

# Example
see waapi.php for complete php function of all API endpoint.
