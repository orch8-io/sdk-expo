require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# The on-device engine ships as the `Orch8Mobile` CocoaPod (UniFFI Swift
# bindings + Orch8Mobile.xcframework). Pin it exactly: the Swift sources in
# this directory are compiled against that binding surface, and a different
# engine version can change record fields or FFI checksums.
orch8_native_version = package.fetch('orch8NativeVersion')

Pod::Spec.new do |s|
  s.name           = 'Orch8Expo'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.source         = { :git => 'https://github.com/orch8-io/sdk-expo.git', :tag => "v#{s.version}" }

  # Orch8Mobile.xcframework is built with IPHONEOS_DEPLOYMENT_TARGET=16.0.
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Orch8Mobile', orch8_native_version

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
