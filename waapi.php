<?php
//==================================================================
//API KEY. From Localhost Only
//==================================================================
//generate apikey for sessionid. Shall be from localhost only
function genapi($url, $sessionid) {
    $genApiKeyUrl = "$url/genapi/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $genApiKeyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode == 200) {
            $result = json_decode($response, true);
            echo "success";
        } else {
            echo "Failed : $response\n";
        }
    }
    curl_close($ch);
}

//get apikey for sessionid. Shall be from localhost only
function getapi($url, $sessionid) {
    $getApiKeyUrl = "$url/getapi/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $getApiKeyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode == 200) {
            $result = json_decode($response, true);
            return $result["apiKey"];
        } else {
            echo "Failed to get API key. HTTP Status Code: $httpCode\n";
            echo "Response: $response\n";
        }
    }
    curl_close($ch);
}
//delete api key. Shall be from localhost only
function delapi($url, $sessionid) {
    $deleteApiKeyUrl = "$url/delapi/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $deleteApiKeyUrl);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode == 200) {
            echo "API Key for session $sessionid deleted successfully\n";
        } else {
            echo "Failed to delete API key. HTTP Status Code: $httpCode\n";
            echo "Response: $response\n";
        }
    }
    curl_close($ch);
}
//==================================================================
//Session Initialisation
//==================================================================
//start socket for sessionid
function start($url, $sessionid, $apikey) {
    $endpointurl = "$url/start/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $endpointurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: $apikey"]);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode == 200) {
            echo "Socket for session $sessionid Started\n";
        } elseif ($httpCode == 500) {
            echo "Failed to start socket for session $sessionid\n";
            echo "Response: $response\n";
        }
    }
    curl_close($ch);
}
//get qr for sessionid
function getqr($url, $sessionid, $apikey) {
    $endpointurl = "$url/getqr/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $endpointurl);
    sleep(3);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: $apikey"]);
    $qrcode = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($http_code == 200) {
        echo "QR code received: <br>" . $qrcode;
    } elseif ($http_code == 404) {
        echo "QR code already scanned or socket not RUNNING";
    } else {
        echo "Unexpected error: " . $qrcode;
    }
    curl_close($ch);
}
//check socket status for sessionid
function socketstat($url, $sessionid, $apikey) {
    $socketStatusUrl = "$url/socketstat/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $socketStatusUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: $apikey"]);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode == 200) {
            echo "Socket status for session $sessionid: RUNNING\n";
        } elseif ($httpCode == 404) {
            echo "Socket status for session $sessionid: STOP\n";
        } else {
            echo "Failed to get socket status. HTTP Status Code: $httpCode\n";
            echo "Response: $response\n";
        }
    }
    curl_close($ch);
}
//==================================================================
//sending messages
//==================================================================
//sending text message
function text($url, $sessionid, $number, $text, $apikey) {
    // Endpoint URL
    $endpointurl = "$url/message/$sessionid";
    // Data to be sent in the request body
    $data = ["sessionId" => $sessionid, "id" => "$number@s.whatsapp.net", // replace with the WhatsApp ID
    "text" => $text, ];
    // Initialize cURL session
    $ch = curl_init($endpointurl);
    // Set cURL options
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "x-api-key: $apikey"]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    // Execute cURL session
    $response = curl_exec($ch);
    if ($response === false) {
        echo "Curl error: " . curl_error($ch);
    } else {
        echo $response;
    }
    // Close cURL session
    curl_close($ch);
}
//sending image message by url
function image($url, $sessionid, $number, $caption, $imageurl, $apikey) {
    $sessionId = $sessionid;
    $id = "$number@s.whatsapp.net"; // e.g., '1234567890@s.whatsapp.net'
    $text = $caption;
    $attachmentUrl = $imageurl;
    $data = ["sessionId" => $sessionId, "id" => $id, "text" => $text, "attachment" => $attachmentUrl, ];
    $endpointurl = "$url/sendimageurl/$sessionid";
    $ch = curl_init($endpointurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "x-api-key: $apikey"]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        die("Error: " . $error);
    }
    curl_close($ch);
    echo $response;
}
//sending file message by url
function sendfile($url, $sessionid, $number, $caption, $fileurl, $apikey) {
    $sessionId = $sessionid;
    $id = "$number@s.whatsapp.net"; // e.g., '1234567890@s.whatsapp.net'
    $text = $caption;
    $attachmentUrl = $fileurl;
    $filename = basename($attachmentUrl);
    $data = ["sessionId" => $sessionId, "id" => $id, "text" => $text, "attachment" => ["url" => $attachmentUrl, "fileName" => $filename, ], ];
    $endpointurl = "$url/sendfileurl/$sessionid";
    $ch = curl_init($endpointurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "x-api-key: $apikey"]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        die("Error: " . $error);
    }
    curl_close($ch);
    echo $response;
}
//==================================================================
//setup webhook
//==================================================================
//set webhook for a session ID
function setwebhook($url, $sessionid, $webhookurl, $apikey) {
    $endpointurl = "$url/set-webhook/$sessionid";
    $data = ['webhookUrl' => $webhookurl];
    $ch = curl_init($endpointurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', "x-api-key: $apikey"]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $response = curl_exec($ch);
    if ($response === false) {
        echo 'Curl error: ' . curl_error($ch);
    } else {
        echo 'Response: ' . $response;
    }
    curl_close($ch);
}
//start socket for sessionid
function checkwebhook($url, $sessionid, $apikey) {
    $endpointurl = "$url/get-webhook/$sessionid";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $endpointurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: $apikey"]);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        echo "Error:" . curl_error($ch);
    } else {
        echo $response;
    }
    curl_close($ch);
}
?>
