import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const Index = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, { read: number; written: number; error?: string }> | null>(null);
  const [error, setError] = useState("");

  const handleMigrate = async () => {
    setLoading(true);
    setError("");
    setResults(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("migrar-dados", {
        body: { email, password },
      });

      if (fnError) {
        setError(fnError.message);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setResults(data.results);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Migrar Dados do Sistema X (Cloud)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Insira suas credenciais do Sistema X para migrar os dados para este Supabase.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Email do Sistema X"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Senha do Sistema X"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={handleMigrate} disabled={loading || !email || !password} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Migrando...</> : "Iniciar Migração"}
          </Button>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
          )}

          {results && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {Object.entries(results).map(([table, info]) => (
                <div key={table} className="flex items-center justify-between text-sm border-b pb-1">
                  <span className="font-mono">{table}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{info.read}→{info.written}</span>
                    {info.error ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
