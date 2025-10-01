import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const onboardingComplete = localStorage.getItem("onboardingComplete");
    if (!onboardingComplete) {
      navigate("/onboarding");
    } else {
      navigate("/");
    }
  }, [navigate]);

  return null;
};

export default Index;
