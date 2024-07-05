# What it is
A very simple Node js script for whatsapp api using bailey, support multi session. 

# Installation
donwload or clone the files. run `yarn` and then `node app.js` the server will run in port 3000.
To change port simply edit app.js change `const port = 3000` to something else

# API
**Start socket for a session :**

    get http://localhost:3000/start/sessionId
Replace sessionId with unique session. You should start socket for each session to make each sessionId work.

**Check socket status for a session :**

    get http://localhost:3000/socketstat/sessionId
Replace

**Generate QR-Code :**

    get http://localhost:3000/getqr/sessionId

**Send Message**

    post http://localhost:3000/message
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => message content
php curl example   

    <?php

	// Endpoint URL
	$url = 'http://localhost:3000/message';

	// Data to be sent in the request body
	$data = [
    'sessionId' => 'sessionid',
    'id' => 'phonenumberwithcountrycode@s.whatsapp.net', // replace with the WhatsApp ID
    'text' => 'messages'
	];

	// Initialize cURL session
	$ch = curl_init($url);

	// Set cURL options
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
	]);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

	// Execute cURL session
	$response = curl_exec($ch);
	if ($response === false) {
    echo 'Curl error: ' . curl_error($ch);
	} else {
    echo 'Response: ' . $response;
	}

	// Close cURL session
	curl_close($ch);
	?>

# Webhook
The script support simple webhook to return incoming message and sender number.

**Set webhook for session id**

    post http://localhost:3000/set-webhook/
    body:
    sessionId => sessionid
    webhookUrl => webhook url
php curl example 

    <?php

	$sessionId = 'sessionid'; // replace with your session ID
	$webhookUrl = 'https://webhook url'; // replace with your desired webhook URL

	$data = [
    'webhookUrl' => $webhookUrl
	];

	$url = 'http://localhost:3000/set-webhook/' . $sessionId;

	$ch = curl_init($url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
	]);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

	$response = curl_exec($ch);
	if ($response === false) {
    echo 'Curl error: ' . curl_error($ch);
	} else {
    echo 'Response: ' . $response;
	}

	curl_close($ch);
	?>

**Check webhook url already setup for a sessionid**

    get http://localhost:3000/get-webhook/sessionId
