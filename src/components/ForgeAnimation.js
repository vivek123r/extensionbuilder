import React, { useEffect, useState } from 'react';

const ForgeAnimation = ({ onAnimationComplete }) => {
  const [isForging, setIsForging] = useState(false);
  const [componentsShattered, setComponentsShattered] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const startForgeAnimation = () => {
    // Only start animation if not already in progress
    if (isForging) return;
    
    // Start the animation sequence
    setIsForging(true);

    // Add the shake class to body
    document.body.classList.add('forge-shake');

    // After shaking, shatter the components
    setTimeout(() => {
      document.body.classList.remove('forge-shake');
      setComponentsShattered(true);
      document.body.classList.add('forge-shatter');
      
      // Sound effect for shattering
      const shatterSound = new Audio('/forge-shatter.mp3');
      shatterSound.volume = 0.5;
      shatterSound.play().catch(() => console.log('Sound play prevented by browser'));

      // After components are shattered, begin rebuilding
      setTimeout(() => {
        document.body.classList.remove('forge-shatter');
        setRebuilding(true);
        document.body.classList.add('forge-rebuild');
        
        // Sound effect for rebuilding
        const rebuildSound = new Audio('/forge-rebuild.mp3');
        rebuildSound.volume = 0.5;
        rebuildSound.play().catch(() => console.log('Sound play prevented by browser'));

        // Animation complete
        setTimeout(() => {
          document.body.classList.remove('forge-rebuild');
          setIsForging(false);
          setComponentsShattered(false);
          setRebuilding(false);
          
          // Callback when animation is complete
          if (onAnimationComplete) {
            onAnimationComplete();
          }
        }, 2000); // Rebuild duration
      }, 1000); // Shatter duration
    }, 1000); // Shake duration
  };

  // Create global event listener for the forge hammer click
  useEffect(() => {
    // Define a global function that can be called from any component
    window.startForgeAnimation = startForgeAnimation;
    
    // Cleanup function
    return () => {
      delete window.startForgeAnimation;
      document.body.classList.remove('forge-shake', 'forge-shatter', 'forge-rebuild');
    };
  }, []);

  return null; // This component doesn't render anything directly
};

export default ForgeAnimation;