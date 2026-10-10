require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'LonglongSpeech'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'Proprietary'
  s.homepage = 'https://longlong.invalid'
  s.author = 'LongLong'
  s.source = { :git => 'https://longlong.invalid/longlong-speech.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
