"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAccessStore } from "../store/access";

interface AccessControlProps {
  children: ReactNode;
}

export function AccessControl({ children }: AccessControlProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const router = useRouter();

  const storedAccessCode = useAccessStore.getState().accessCode;

  useEffect(() => {
    const accessGranted = localStorage.getItem("access_granted");
    if (accessGranted === "true") {
      setHasAccess(true);
    }
  }, []);

  const handleAccessCodeSubmit = () => {
    if (inputCode === storedAccessCode) {
      localStorage.setItem("access_granted", "true");
      setHasAccess(true);
    } else {
      alert("Incorrect Access Code");
    }
  };

  if (!hasAccess) {
    return (
        <div className="access-page">
          <h2>Please enter the Access Code</h2>
          <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter your access code"
          />
          <button onClick={handleAccessCodeSubmit}>Submit</button>
        </div>
    );
  }

  // Once access is granted, render the children
  return <>{children}</>;
}
