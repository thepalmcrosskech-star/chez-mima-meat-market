import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import BrandHeader from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-svh flex flex-col bg-background"><BrandHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Page introuvable</p>
        <Button onClick={() => navigate("/")}>Retour à l’accueil</Button>
      </div>
    </div>
  );
};

export default NotFound;
