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
    
**Generate QR-Code :**

    get http://localhost:3000/getqr/sessionId
    
**Check no on whatsapp :**

    get http://localhost:3000/checkno/sessionId/phonenumberwithcountrycode

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

**Send image via url**

    post http://localhost:3000/sendimageurl
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => caption
    attachment => image url
    
   php curl example   

    <?php
    $sessionId = 'sessionId';
    $id = 'phonenumberwithcountrycode@s.whatsapp.net'; // replace with the WhatsApp ID
    $text = 'Here is an image for you!';
    $attachmentUrl = "http://localhost/img.jppeg"; // replace with file url

    $data = [
    	'sessionId' => $sessionId,
    	'id' => $id,
    	'text' => $text,
    	'attachment' => $attachmentUrl
	];

    $url = 'http://localhost:3000/sendimageurl';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
	]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

    $response = curl_exec($ch);

    if ($response === false) {
    	$error = curl_error($ch);
    	curl_close($ch);
    	die('Error: ' . $error);
	}

    curl_close($ch);

    echo 'Response: ' . $response;
    ?>
 
**Send files via url**

    post http://localhost:3000/sendfileurl
    body :
    sessionid => sessionid
    id => phonenumberwithcountrycode@s.whatsapp.net
    text => caption
    attachment => file url
    filename => file name include file format

   php curl example   

    <?php
    $sessionId = 'sessionId';
    $id = 'phonenumberwithcountrycode@s.whatsapp.net'; // replace with the WhatsApp ID
    $text = 'Here is a doc for you!';
    $attachmentUrl = "http://localhost/doc.pdf"; // replace with file url
    $filename = basename($attachmentUrl);

    $data = [
	'sessionId' => $sessionId,
       	'id' => $id,
    	'text' => $text,
    	'attachment' => [
        	'url' => $attachmentUrl,
        	'fileName' => $filename
    		]
	];
    
    $url = 'http://localhost:3000/sendfileurl';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

    $response = curl_exec($ch);

    if ($response === false) {
    	$error = curl_error($ch);
    	curl_close($ch);
    	die('Error: ' . $error);
    }

    curl_close($ch);

    echo 'Response: ' . $response;
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

# Localhost restriction
Most of the code protected to be access only from localhost. to modified it, remove 'restrictToLocalhost' function from each endpoint.
