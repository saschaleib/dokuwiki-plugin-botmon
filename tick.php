<?php /* MONITOR PLUGIN HEARTBEAT TICKER SCRIPT */

/* build the resulting log line (ensure fixed column positions!) */
$logArr = Array(
	$_SERVER['REMOTE_ADDR'] ?? '', /* remote IP */
	$_GET['p'] ?? '', /* page ID */
	$_COOKIE['DokuWiki'] ?? session_id() ?? '', /* DokuWiki session ID */
	$_SERVER['HTTP_USER_AGENT'] ?? '' /* User agent */
);

/* create the log line */
$filename = 'logs/' . gmdate('Y-m-d') . '.tck'; /* use GMT date for filename */
$line = gmdate('Y-m-d H:i:s'); /* use GMT time for log entries */
foreach ($logArr as $val) {
	$line .= "\t" . $val;
};

/* write the log line to the file */
$tickfile = fopen($filename, 'a');
if (!$tickfile) {
	http_response_code(500);
	die("Error: Unable to open log file. Please check file permissions.");
}
if (fwrite($tickfile, $line . "\n") === false) {
	http_response_code(500);
	fclose($tickfile);
	die("Error: Could not write to log file.");
}
fclose($tickfile);

/* Send "Accepted" header */
http_response_code(202);
echo "OK";