require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'AlgorithmXReactNativeSDK'
  s.version       = package['version']
  s.summary       = 'AlgorithmX SDK for React Native – iOS bridge'
  s.homepage      = 'https://github.com/algorithmx-cloud/algorithmx-react-native-sdk'
  s.license       = { :type => 'MIT', :file => 'LICENSE' }
  s.author        = { 'AlgorithmX' => 'hello@algorithmx.cloud' }
  s.platform      = :ios, '15.1'
  s.swift_version = '5.9'
  # Autolinking installs this pod from node_modules; the source is only used
  # when someone references the pod outside an npm install.
  s.source        = { :git => 'https://github.com/algorithmx-cloud/algorithmx-react-native-sdk.git', :tag => s.version.to_s }

  s.source_files  = 'ios/**/*.{h,m,swift}'

  # React Native's helper adds React-Core and the New Architecture interop deps.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end

  # Native iOS SDK. CocoaPods trunk stops accepting new pods on December 2, 2026,
  # so the app's Podfile installs it from the Git tag:
  #   pod 'AlgorithmXSDK', :git => 'https://github.com/algorithmx-cloud/algorithmx-ios-sdk.git', :tag => '1.0.0'
  s.dependency 'AlgorithmXSDK', '~> 1.0'
end
