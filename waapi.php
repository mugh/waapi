<?php
//==================================================================
//API KEY. required system api key.
//==================================================================
//generate apikey for sessionid. 
function genapi($url, $sessionid, $sysapikey)
{

    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/key/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_HTTPHEADER => array(
            'Accept: application/json',
            "x-system-api-key: $sysapikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;

}

//get apikey for sessionid. 
function getapi($url, $sessionid, $sysapikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/key/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HTTPHEADER => array(
            'Accept: application/json',
            "x-system-api-key: $sysapikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}

//delete api key. 
function delapi($url, $sessionid, $sysapikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/key/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => array(
            "x-system-api-key: $sysapikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
//==================================================================
//Session Initialisation
//==================================================================
//start socket for sessionid
function start($url, $sessionid, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/sessions/$sessionid/start",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_HTTPHEADER => array(
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;

}
//delete sessionid (also delete its api key)
function delsession($url, $sessionid, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/sessions/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => array(
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
//get qr for sessionid
function getqr($url, $sessionid, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/sessions/$sessionid/qrcode",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HTTPHEADER => array(
            'Accept: application/json',
            "x-api-key: $apikey"
        ) ,
    ));
    sleep(3);
    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;

}
//check socket status for sessionid
function socketstat($url, $sessionid, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/sessions/$sessionid/status",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HTTPHEADER => array(
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
//==================================================================
//sending messages
//==================================================================
//sending text message
function text($url, $sessionid, $number, $text, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/send/$sessionid/messages",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => '{
			"number" : "'.$number.'",
			"text" : "$text"
}',
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
function image($url, $sessionid, $number, $caption, $imageurl, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/send/$sessionid/messages/image",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => '{
            "number": "'.$number.'",
            "text": "'.$caption.'",
            "attachment": {
                "url": "'.$imageurl.'"
            }
        }',
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            "x-api-key: $apikey"
        ),
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}


function sendfile($url, $sessionid, $number, $caption, $fileurl, $apikey)
{
    $filename = basename($fileurl);
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/send/$sessionid/messages/file",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => '{
            "number": "'.$number.'",
            "text": "'.$caption.'",
            "attachment": {
                "url": "'.$fileurl.'",
                "fileName": "'.$filename.'"
            }
        }',
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            "x-api-key: $apikey"
        ),
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
//==================================================================
//setup webhook
//==================================================================
//set webhook for a session ID
function setwebhook($url, $sessionid, $webhookurl, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/webhook/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => '{
            "webhookUrl": "'.$webhookurl.'"
        }',
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            "x-api-key: $apikey"
        ),
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}

//get webhook for a session ID
function checkwebhook($url, $sessionid, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/webhook/$sessionid",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HTTPHEADER => array(
            'Accept: application/json',
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}

//check wa no
function onwa($url, $sessionid, $phoneno, $apikey)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "$url/sessions/$sessionid/check/$phoneno",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HTTPHEADER => array(
            'Accept: application/json',
            "x-api-key: $apikey"
        ) ,
    ));

    $response = curl_exec($curl);
    $data = json_decode($response, true);

    curl_close($curl);
    return $data;
}
?>
