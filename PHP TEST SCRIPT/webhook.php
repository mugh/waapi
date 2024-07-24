<?php
include 'waapi.php';

$id="mugh";
$url="http://localhost:3000";
$apikey = getapi($url, $id);
//echo $apikey;

$webhookurl="https://webhook-test.com/fcfe27a2fe6e3e704554999ed4640223";

setwebhook($url, $id, $webhookurl, $apikey);
echo "<br><br><br>";
checkwebhook($url, $id, $apikey);

