"use client";



import { ReactNode } from "react";



export function PageBackground() {

  return (

    <div className="pointer-events-none fixed inset-0 -z-10 bg-background" aria-hidden />

  );

}



export function FadeIn({

  children,

  className,

}: {

  children: ReactNode;

  index?: number;

  className?: string;

}) {

  return <div className={className}>{children}</div>;

}



export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {

  return <div className={className}>{children}</div>;

}



export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {

  return <div className={className}>{children}</div>;

}

