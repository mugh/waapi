<?php

include 'waapi.php';

$id="dodoy";
$api= getapi("http://localhost:3000", $id);
//$api= genapi("http://localhost:3000", $id);


if($api==""){
	$apikey= genapi("http://localhost:3000", $id);
	$newapi= getapi("http://localhost:3000", $id);
	echo "$newapi";
}
else{
	$apikey=$api;
	echo "$apikey";
}

/*
echo "<br><br><br>";
start("http://localhost:3000", $id, $api);

echo "<br><br><br>";
socketstat("http://localhost:3000", $id, $api);

echo "<br><br><br>";
getqr("http://localhost:3000", $id, $api);*/