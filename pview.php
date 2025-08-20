<?php /* MONITOR PLUGIN PAGE VIEW SCRIPT */

/* parse the JSON payload */
$json = json_decode($_POST['pageview'], true);
if (!$json) {
	http_response_code(400);
	die("Error: Invalid JSON data sent to server.");
}

/* build the resulting log line (ensure fixed column positions!) */
$logArr = Array(
	$_SERVER['REMOTE_ADDR'] ?? 'null', /* remote IP */
	$json['pg'] ?? 'null', /* DW page ID */
	$_COOKIE['DokuWiki'] ?? 'null', /* DokuWiki session ID */
	$json['u'] ?? 'null' /* DW User id (if logged in) */
	// $json['tz'] ?? 'null', /* timzone offset */
	// $json['lg'] ?? 'null', /* browser language */
	// $json['td'] ?? 'null', /* load time */
	// $json['scr'] ?? 'null', /* Screen dimensions */
	// $json['l'] ?? 'null', /* Accepted languages list */
	// $json['url'] ?? 'null', /* Full request URL */
	// $json['r'] ?? 'null', /* Referrer URL */
	// $_SERVER['HTTP_USER_AGENT'] ?? 'null', /* User agent */
	// $json['t'] ?? '' /* Page title */
);

/* create the log line */
$filename = 'logs/' . gmdate('Y-m-d') . '.log'; /* use server datetime */
$logline = gmdate('Y-m-d H:i:s');
foreach ($logArr as $val) {
	$logline .= "\t" . $val;
};

/* write the log line to the file */
$logfile = fopen($filename, 'a');
if (!$logfile) {
	http_response_code(500);
	die("Error: Unable to open log file. Please check file permissions.");
}

if (fwrite($logfile, $logline . "\n") === false) {
	http_response_code(500);
	fclose($logfile);
	die("Error: Could not write to log file.");
}
fclose($logfile);

/* send a 202 response */
http_response_code(202);
echo "OK";