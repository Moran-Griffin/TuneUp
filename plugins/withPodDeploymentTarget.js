// Raises every CocoaPods target to at least iOS 15.1.
// Xcode 27's iOS SDK rejects targets below 15.0, and some pods
// (e.g. RNCAsyncStorage, RNSVG resource bundles) still declare 12.4/13.4.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# tuneup: min pod deployment target';
const MIN = '15.1';

const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end
`;

module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        const anchor = 'post_install do |installer|';
        if (!src.includes(anchor)) throw new Error('withPodDeploymentTarget: post_install block not found in Podfile');
        src = src.replace(anchor, anchor + SNIPPET);
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};
