<?php /* BOTMON PLUGIN HEARTBEAT TICKER SCRIPT */

	// Note: this script is normally called in HEAD mode, therefore it can not return any payload.

	// what is the session identifier?
	$sessionId = preg_replace('/[\x00-\x1F{};\"\']/', "\u{FFFD}", $_GET['id']) /* clean json parameter */
		?? session_id()
		?? $_SERVER['REMOTE_ADDR'];


	// clean the page ID
	$pageId = preg_replace('/[\x00-\x1F]/', "\u{FFFD}", $_GET['p'] ?? '');

	// clean the user agent string
	$agent = preg_replace('/[\x00-\x1F]/', "\u{FFFD}", $_SERVER['HTTP_USER_AGENT'] ?? '');
	
	/* build the resulting log line */
	$logArr = Array(
		$_SERVER['REMOTE_ADDR'] ?? '', /* Remote IP */
		$pageId, /* Page ID */
		$sessionId, /* Session ID */
		$agent /* User agent */
	);

	/* create the log line */
	$filename = 'logs/' . gmdate('Y-m-d') . '.tck.txt'; /* use GMT date for filename */
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
		http_response_code(507);
		fclose($tickfile);
		die("Error: Could not write to log file.");
	}
	fclose($tickfile);

	/* Send "Accepted" header */
	http_response_code(202);
	echo "OK";