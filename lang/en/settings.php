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

$lang['geoiplib']			= 'Add GeoIP Information <a href="https://leib.be/sascha/projects/dokuwiki/botmon/config/settings#add_geoip_information" target="_blank" title="More information">🛈</a>';
	$lang['geoiplib_o_disabled']		= 'Disabled';
	$lang['geoiplib_o_phpgeoip']		= 'Use PHP GeoIP Module';
	$lang['geoiplib_o_cloudflare']		= 'Use Cloudflare GeoIP';

$lang['useCaptcha']		= 'Enable Captcha <a href="https://leib.be/sascha/projects/dokuwiki/botmon/config/settings#enable_captcha" target="_blank" title="More information">🛈</a>';
	$lang['useCaptcha_o_disabled']		= 'Disabled';
	$lang['useCaptcha_o_loremipsum']	= 'Captcha with Lorem ipsum text';
	$lang['useCaptcha_o_dada']			= 'Captcha with Dada placeholder text';

$lang['captchaSeed']	= 'Captcha Seed<br><small>(Enter a random string, e.g. <a href="https://www.browserling.com/tools/random-hex" target="_blank">from here</a>)</small>';

$lang['captchaOptions']		= 'Captcha options <a href="https://leib.be/sascha/projects/dokuwiki/botmon/config/settings#captcha_options" target="_blank" title="More information">🛈</a>';
	$lang['captchaOptions_langmatch']	= 'Language match bypass';
	$lang['captchaOptions_anyval']		= 'Ignore cookie value';
