<?php
/**
 * BotMon Helper Plugin
 *
 * @license GPL 2 (http://www.gnu.org/licenses/gpl.html)
 * @author  Sascha Leib <ad@hominem.info>
 */

use dokuwiki\Extension\Plugin;

class helper_plugin_botmon extends Plugin {

	/**
	 * Constructor
	 */
	public function __construct() {
		echo "<li>Processing logfiles …</li>\n";
	}

	/**
	 * Cleanup function
	 */
	public function cleanup() {

		// exclude the following two dates:
		$today = gmdate('Y-m-d');
		$yesterday = gmdate('Y-m-d', time() - 86400);

		// scan the log directory and delete all files except for today and yesterday:
		$dir = scandir(DOKU_PLUGIN . 'botmon/logs');
		foreach($dir as $file) {
			$fName = pathinfo($file, PATHINFO_BASENAME);
			$bName = strtok($fName, '.');

			if ($bName == '' || $bName == 'logfiles' || $bName == 'empty' || $fName == '.htaccess') {
				// echo "File “{$fName}” ignored.\n";
			} else if ($bName == $today || $bName == $yesterday) {
				echo "<li class='skipped'>File “{$fName}” skipped.</li>\n";
			} else {
				if (unlink(DOKU_PLUGIN . 'botmon/logs/' . $file)) {
					echo "<li class='success'>File “{$fName}” deleted.</li>\n";
				} else {
					echo "<li class='error'>File “{$fName}” could not be deleted!</li>\n";
				}
			}
		}
		echo "<li>Done.</li>\n";
	}

}