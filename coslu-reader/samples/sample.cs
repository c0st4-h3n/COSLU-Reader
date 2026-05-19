// Coslu Reader — sample C# (Tier S via Shiki)
using System;
using System.Linq;

namespace CosluLabz;

public record Familia(string Nome, int Tier = 1);

public static class Program
{
    public static void Main(string[] args)
    {
        var fams = new[] { new Familia("texto"), new Familia("hex", 0) };
        foreach (var f in fams.Where(x => x.Tier >= 0))
            Console.WriteLine($"{f.Nome} → tier {f.Tier}");
    }
}
