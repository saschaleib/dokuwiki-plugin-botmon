<h1>BotMon Cleanup Script</h1>
<ul><?php

	// exclude the following two dates:
	$today = gmdate('Y-m-d');
	$yesterday = gmdate('Y-m-d', time() - 86400);

	// scan the log directory and delete all files except for today and yesterday:
	$dir = scandir('logs');
	foreach($dir as $file) {
		$fName = pathinfo($file, PATHINFO_BASENAME);
		$bName = strtok($fName, '.');

		echo "<li>File “{$fName}” – ";
		if ($bName == '' || $bName == 'logfiles') {
			echo " <em>ignored</em></li>";
		} else if ($bName == $today || $bName == $yesterday) {
			echo " <em>skipped</em></li>";
		} else {
			if (unlink('logs/' . $file)) {
				echo "deleted.</li>";
			} else {
				echo " <strong>not deleted!</strong></li>";
			}
		}
	}
 ?></ul>
