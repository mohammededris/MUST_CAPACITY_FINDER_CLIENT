// import { useAuth } from "@clerk/react";
// import { useNavigate, useEffect } from "react";

// export default function ProtectedRoute({ children }) {
//   const { isLoaded, isSignedIn } = useAuth();
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (isLoaded && !isSignedIn) {
//       navigate("/"); // or wherever your sign-in page/flow is
//     }
//   }, [isLoaded, isSignedIn, navigate]);

//   if (!isLoaded || !isSignedIn) return navigate("/"); // or a loading spinner

//   return children;
// }
import { useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <p>Loading...</p>;

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}
