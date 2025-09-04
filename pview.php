<?php /* BOT MONITOR PLUGIN PAGE VIEW SCRIPT */

/* parse the JSON payload */
$json = json_decode($_POST['pageview'], true);
if (!$json) {
	http_response_code(400);
	die("Error: Invalid JSON data sent to server.");
}

// what is the session identifier?
$sessionId = $_COOKIE['DokuWiki'] ?? null;
$sessionType = 'dw';
if (!$sessionId) {
	$sessionId = $_SERVER['REMOTE_ADDR'] ?? '';
	if ($sessionId == '127.0.0.1' || $sessionId == '::1') {
		$sessionId = 'localhost';
	}
	$sessionType = 'ip';
}

/* build the resulting log line (ensure fixed column positions!) */
$logArr = Array(
	$_SERVER['REMOTE_ADDR'] ?? '', /* remote IP */
	$json['pg'] ?? '', /* DW page ID */
	$sessionId, /* Session ID */
	$json['u'] ?? '', /* DW User id (if logged in) */
	$json['lt'] ?? '', /* load time */
	$json['r'] ?? '', /* Referrer URL */
	$_SERVER['HTTP_USER_AGENT'] ?? '' /* User agent */
	// $json['lg'] ?? '', /* browser language */
	// $json['scr'] ?? '', /* Screen dimensions */
	// $json['tz'] ?? '', /* timzone offset */
	// $json['l'] ?? '', /* Accepted languages list */
	// $json['url'] ?? '', /* Full request URL */
	// $json['t'] ?? '' /* Page title */
);

/* create the log line */
$filename = 'logs/' . gmdate('Y-m-d') . '.log.txt'; /* use server datetime */
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