import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WelcomeTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Check if this is first time after onboarding
    const hasSeenTour = localStorage.getItem('hasSeenWelcomeTour');
    const justCompletedOnboarding = sessionStorage.getItem('justCompletedOnboarding');
    
    if (!hasSeenTour && justCompletedOnboarding) {
      setIsOpen(true);
      sessionStorage.removeItem('justCompletedOnboarding');
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem('hasSeenWelcomeTour', 'true');
    setIsOpen(false);
  };

  const tourSteps = [
    {
      title: "Welcome to BarcodeTruth! 🎉",
      content: (
        <div className="space-y-4">
          <p>Thank you for joining our beta! Your preferences have been saved.</p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">We're in Early Access</p>
            <p className="text-sm text-muted-foreground">
              BarcodeTruth is actively being developed. You may encounter bugs, 
              missing data, or features that don't work perfectly yet.
            </p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Your Feedback Matters</p>
            <p className="text-sm text-muted-foreground">
              Every scan, rating, and suggestion helps us improve. Thank you for 
              being an early supporter! 💚
            </p>
          </div>
        </div>
      )
    },
    {
      title: "How to Use the App 📱",
      content: (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h4 className="font-semibold">Scan Products</h4>
              <p className="text-sm text-muted-foreground">
                Click "Scan" in the bottom nav to scan any barcode in the store
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h4 className="font-semibold">See Your Match</h4>
              <p className="text-sm text-muted-foreground">
                View personalized scores showing how the brand aligns with YOUR values
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h4 className="font-semibold">Read Evidence</h4>
              <p className="text-sm text-muted-foreground">
                See real news articles explaining why brands got their scores
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div>
              <h4 className="font-semibold">Find Alternatives</h4>
              <p className="text-sm text-muted-foreground">
                Discover better-matched brands if the product doesn't align
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "You Get 5 Free Scans 🎁",
      content: (
        <div className="space-y-4">
          <p>
            Try the app with 5 free product scans. After that, you can upgrade 
            to unlimited scanning.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Tip: Make Them Count!</p>
            <p className="text-sm text-muted-foreground">
              Scan products you regularly buy to see if they match your values.
            </p>
          </div>
          <p className="text-center font-medium text-lg">
            Ready to start scanning? 🚀
          </p>
        </div>
      )
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tourSteps[step].title}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {tourSteps[step].content}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-1">
            {tourSteps.map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full ${idx === step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < tourSteps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleComplete}>
                Start Scanning!
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
