import React, { useEffect, useRef } from 'react';
import './StepTransition.css';

const StepTransition = ({ isActive, direction = 'forward', currentStep, previousStep }) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isActive && overlayRef.current) {
      // Add the active class when transition starts
      overlayRef.current.classList.add('active');
      
      // Add transition class to the body for additional effects
      document.body.classList.add('step-transition');
      
      // Find current and previous step content elements using class names
      const currentStepContent = document.querySelector(`.step-content.step-${currentStep}`);
      const previousStepContent = document.querySelector(`.step-content.step-${previousStep}`);
      
      if (previousStepContent) {
        // Remove any existing classes first
        previousStepContent.classList.remove('step-exit', 'step-enter');
        // Apply exit animation to previous step content
        previousStepContent.classList.add('step-exit');
      }
      
      if (currentStepContent) {
        // Remove any existing classes first
        currentStepContent.classList.remove('step-exit', 'step-enter');
        // Apply enter animation to current step content
        currentStepContent.classList.add('step-enter');
        
        // Make sure content is properly positioned
        currentStepContent.style.display = 'flex';
        currentStepContent.style.flexDirection = 'column';
        currentStepContent.style.alignItems = 'stretch';
        currentStepContent.style.justifyContent = 'flex-start';
        currentStepContent.style.height = '100%';
        
        // Add animation delays to child elements for staggered appearance
        const formElements = currentStepContent.querySelectorAll('.form-group, .type-card, .btn, h3');
        formElements.forEach((el, index) => {
          el.style.setProperty('--element-index', index);
        });
      }
      
      // Remove classes after animation completes
      const timeout = setTimeout(() => {
        if (overlayRef.current) {
          overlayRef.current.classList.remove('active');
        }
        document.body.classList.remove('step-transition');
        
        if (previousStepContent) {
          previousStepContent.classList.remove('step-exit');
          previousStepContent.style.display = 'none';
        }
        
        if (currentStepContent) {
          currentStepContent.classList.remove('step-enter');
          
          // Ensure proper positioning
          currentStepContent.style.transform = 'translateZ(0) scale(1)';
          currentStepContent.style.opacity = '1';
          
          // Reset the animation delays
          const formElements = currentStepContent.querySelectorAll('.form-group, .type-card, .btn, h3');
          formElements.forEach(el => {
            el.style.removeProperty('--element-index');
            el.style.opacity = '1';
            el.style.transform = 'translateZ(0)';
          });
        }
      }, 2500);
      
      return () => clearTimeout(timeout);
    }
  }, [isActive, currentStep, previousStep, direction]);

  return (
    <div 
      ref={overlayRef}
      className="transition-overlay"
      aria-hidden="true"
    />
  );
};

export default StepTransition;