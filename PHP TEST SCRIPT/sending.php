<?php
include 'waapi.php';

$id="myid";
$url="http://localhost:3000";
$apikey = getapi($url, $id);
//echo $apikey;

$number="6282124987943";
$textcontent="aku disini untukmu,
coba kamu cari tahu";
$caption="attachment buat kamu";
$imageurl = "http://localhost/mygage2024/files/img.jpg";
$fileurl = "http://localhost/mygage2024/files/900747. Termometer. 2023. 10.13-rev1.pdf";

//text($url, $id, $number, $textcontent, $apikey);
//image($url, $id, $number, $caption, $imageurl, $apikey);
//sendfile($url, $id, $number, $caption, $fileurl, $apikey);

