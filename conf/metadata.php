<?php
/**
 * Configuration settings for the BotMon Plugin
 *
 * @author     Sascha Leib <sascha@leib.be>
 */

// How to show data in the admin interface:
$meta['showday'] = array('multichoice',
						'_choices' => array ('yesterday', 'today'));

$meta['combineNets'] = array('onoff');

// Geolocation settings:
$meta['geoiplib'] = array('multichoice',
						'_choices' => array ('disabled', 'phpgeoip','cloudflare'));

// Captcha settings:						
$meta['useCaptcha'] = array('multichoice',
						'_choices' => array ('disabled', 'loremipsum', 'dada'));

$meta['captchaSeed'] = array('string');

$meta['captchaOptions'] = array('multicheckbox',
						'_choices' => array ('langmatch', 'anyval'), '_other' => 'exists');
