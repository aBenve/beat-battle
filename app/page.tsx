import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">BeatBattle</h1>
          <p className="text-xl text-muted-foreground">
            Create a session, invite friends, and compete with music!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create Session</CardTitle>
              <CardDescription>
                Start a new BeatBattle and invite your friends to join
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/create">
                <Button className="w-full" size="lg">
                  Create New Session
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Join Session</CardTitle>
              <CardDescription>
                Enter a session code to join an existing BeatBattle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/join">
                <Button className="w-full" size="lg" variant="outline">
                  Join Existing Session
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
              <li>Create or join a session with friends</li>
              <li>Each participant adds songs to the queue</li>
              <li>Songs play in order - but anyone can force-play their song!</li>
              <li>Rate each song as it plays (1-5 stars)</li>
              <li>The participant with the highest average score wins!</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
