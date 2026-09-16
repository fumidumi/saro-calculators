import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HEATING_CABLES, THERMOSTATS, CONTROL_CABINETS, MOUNTING_TAPES } from "@/data/products";

const Catalog = () => {
  const formatPrice = (price: number) => {
    if (price === 0) {
      return "Цена по запросу";
    }
    return `${price.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Каталог продукции</h1>
          <p className="text-muted-foreground">
            Оборудование SARO для систем антиобледенения
          </p>
        </div>

        <Tabs defaultValue="cables" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="cables">Кабели</TabsTrigger>
            <TabsTrigger value="thermostats">Терморегуляторы</TabsTrigger>
            <TabsTrigger value="cabinets">Шкафы</TabsTrigger>
            <TabsTrigger value="accessories">Аксессуары</TabsTrigger>
          </TabsList>

          <TabsContent value="cables">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {HEATING_CABLES.map((cable) => (
                <Card key={cable.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img 
                      src={cable.image} 
                      alt={cable.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">{cable.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">{cable.length}м</Badge>
                    </div>
                    <CardDescription className="text-xs">Артикул: {cable.article}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Мощность:</span>
                      <span className="font-medium">{cable.power} Вт</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Длина:</span>
                      <span className="font-medium">{cable.length} метров</span>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Цена:</span>
                        <span className={`font-bold text-lg ${cable.price === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatPrice(cable.price)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="thermostats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {THERMOSTATS.map((thermostat) => (
                <Card key={thermostat.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img 
                      src={thermostat.image} 
                      alt={thermostat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">{thermostat.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">{thermostat.maxAmperage}А</Badge>
                    </div>
                    <CardDescription className="text-xs">Артикул: {thermostat.article}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Макс. ток:</span>
                      <span className="font-medium">{thermostat.maxAmperage} А</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Тип:</span>
                      <span className="font-medium">
                        {thermostat.type === 'wall' && 'Настенный'}
                        {thermostat.type === 'din' && 'DIN-рейка'}
                        {thermostat.type === 'outdoor' && 'Уличный IP65'}
                      </span>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Цена:</span>
                        <span className={`font-bold text-lg ${thermostat.price === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatPrice(thermostat.price)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cabinets">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CONTROL_CABINETS.map((cabinet) => (
                <Card key={cabinet.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img 
                      src={cabinet.image} 
                      alt={cabinet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">{cabinet.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">{cabinet.maxAmperage}А</Badge>
                    </div>
                    <CardDescription className="text-xs">Артикул: {cabinet.article}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Макс. ток:</span>
                      <span className="font-medium">{cabinet.maxAmperage} А</span>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Цена:</span>
                        <span className={`font-bold text-lg ${cabinet.price === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatPrice(cabinet.price)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="accessories">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MOUNTING_TAPES.map((tape) => (
                <Card key={tape.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img 
                      src={tape.image} 
                      alt={tape.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg leading-tight">{tape.name}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">{tape.length}м</Badge>
                    </div>
                    <CardDescription className="text-xs">Артикул: {tape.article}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Длина рулона:</span>
                      <span className="font-medium">{tape.length} метров</span>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Цена:</span>
                        <span className={`font-bold text-lg ${tape.price === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatPrice(tape.price)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Catalog;
