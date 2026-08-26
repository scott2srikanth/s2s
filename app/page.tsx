import AuthGate from "./auth-gate";import {getPasswordUser,isSecondFactorVerified} from "./password-auth";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getPasswordUser(),verified=!!user&&await isSecondFactorVerified(user.displayName);return <AuthGate signedIn={!!user} verified={verified} email={user?.email}/>}
