require 'json'
package = JSON.parse(File.read(File.join(__dir__, '../../package.json')))

Pod::Spec.new do |s|
  s.name = 'AlgorithmXExpoIntegration'
  s.version = package['version']
  s.summary = 'Optional Expo startup and notifications integration for AlgorithmX'
  s.homepage = 'https://github.com/algorithmx-cloud/algorithmx-react-native-sdk'
  s.license = { :type => 'MIT', :file => '../../LICENSE' }
  s.author = { 'AlgorithmX' => 'hello@algorithmx.cloud' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/algorithmx-cloud/algorithmx-react-native-sdk.git', :tag => s.version.to_s }
  s.source_files = '*.swift'
  s.dependency 'ExpoModulesCore'
  s.dependency 'AlgorithmXReactNativeSDK', s.version.to_s
end
