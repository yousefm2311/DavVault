'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number; // in seconds
  className?: string;
  decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1.2,
  className = '',
  decimals = 0,
}) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Number(latest).toFixed(decimals));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: duration,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [value, duration, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
};
