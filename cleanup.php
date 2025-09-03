<h1>BotMon Cleanup Script</h1>
<ul><?php

	// get all files in the logs directory
	$dir = scandir('logs');
	$today = gmdate('Y-m-d');
	$yesterday = gmdate('Y-m-d', time() - 86400);

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
