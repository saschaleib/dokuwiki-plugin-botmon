<?php
/**
 * English language file for the BotMon Plugin Settings
 *
 * @author     Sascha Leib <sascha@leib.be>
 */

$lang['showday']			= 'Which data to show in the “Latest” tab:';
	$lang['showday_o_yesterday']		= 'Last full day (yesterday)';
	$lang['showday_o_today']			= 'Ongoing logs (today)';

$lang['combineNets']	= 'Combine visits from known IP-ranges into one entry:';

$lang['geoiplib']			= 'Add GeoIP Information<br><small>(requires <a href="https://www.php.net/manual/en/book.geoip.php" target="_blank">GeoIP</a> PHP module)</small>';
	$lang['geoiplib_o_disabled']		= 'Disabled';
	$lang['geoiplib_o_phpgeoip']		= 'Use GeoIP Module';

$lang['useCaptcha']		= 'Enable Captcha<br><small>(Experimental, read the manual first!)</small>';
	$lang['useCaptcha_o_disabled']		= 'Disabled';
	$lang['useCaptcha_o_loremipsum']	= 'Captcha with Lorem ipsum text';
	$lang['useCaptcha_o_dada']			= 'Captcha with Dada placeholder text';

$lang['captchaSeed']	= 'Captcha Seed<br><small>(Enter a random string, e.g. <a href="https://www.browserling.com/tools/random-hex" target="_blank">from here</a>)</small>';

$lang['captchaOptions']		= 'Captcha options<br><small>(Make sure to read the <a href="https://leib.be/sascha/projects/dokuwiki/botmon/config/settings#captcha_options" target="_blank">documentation</a> first)</small>';
	$lang['captchaOptions_langmatch']	= 'Language match bypass';
	$lang['captchaOptions_anyval']		= 'Ignore cookie value';
