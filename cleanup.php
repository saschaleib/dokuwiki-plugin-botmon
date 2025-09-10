<?php header("Content-Type: text/plain"); ?>BotMon Cleanup Script
=====================
<?php
// exclude the following two dates:
$today = gmdate('Y-m-d');
$yesterday = gmdate('Y-m-d', time() - 86400);

// scan the log directory and delete all files except for today and yesterday:
$dir = scandir('logs');
foreach($dir as $file) {
	$fName = pathinfo($file, PATHINFO_BASENAME);
	$bName = strtok($fName, '.');

	if ($bName == '' || $bName == 'logfiles') {
		//echo "File “{$fName}” ignored.";
	} else if ($bName == $today || $bName == $yesterday) {
		echo "File “{$fName}” skipped.\n";
	} else {
		if (unlink('logs/' . $file)) {
			echo "File “{$fName}” deleted.\n";
		} else {
			echo " File “{$fName}” could not be deleted!\n";
		}
	}
}
echo "Done.\n";