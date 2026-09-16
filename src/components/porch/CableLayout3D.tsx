import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Line } from "@react-three/drei";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useRef } from "react";
import * as THREE from "three";

interface CableLayout3DProps {
  stepLength: number;
  stepWidth: number;
  stepCount: number;
  platformLength: number;
  platformWidth: number;
  cableStep: number;
  threadsPerStep: number;
}

// Компонент для управления камерой
const CameraController = ({ onReset }: { onReset: () => void }) => {
  const controlsRef = useRef<any>(null);
  
  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
    onReset();
  };

  return (
    <>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />
      <Button
        onClick={handleReset}
        size="sm"
        variant="outline"
        className="absolute top-4 right-4 z-10 gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Сбросить вид
      </Button>
    </>
  );
};

const CableLayout3D = ({
  stepLength,
  stepWidth,
  stepCount,
  platformLength,
  platformWidth,
  cableStep,
  threadsPerStep,
}: CableLayout3DProps) => {
  const platformHeight = stepCount * 0.15; // Площадка на высоте всех ступеней

  // Генерация точек для ВСЕГО кабеля (сплошная змейка)
  const generateAllCablePoints = () => {
    const points: [number, number, number][] = [];
    const margin = 0.075; // 7.5см отступ
    
    // ПЛОЩАДКА (змейкой сверху)
    // Защита: минимальный шаг 1см, исключаем NaN/0/отрицательные значения
    const safeCableStepCm = Number.isFinite(cableStep) && cableStep > 1 ? cableStep : 10;
    const platformStepSize = safeCableStepCm / 100; // см в метры
    let y = margin;
    let direction = 1;
    let lastX = margin; // Отслеживаем последнюю X координату
    
    // Защита от зависания: ограничиваем максимальное количество проходов
    const MAX_PASSES = 500;
    let passCount = 0;
    
    while (y < platformLength - margin && passCount < MAX_PASSES) {
      const x1 = direction === 1 ? margin : platformWidth - margin;
      const x2 = direction === 1 ? platformWidth - margin : margin;
      
      points.push([x1, platformHeight + 0.03, -y]);
      points.push([x2, platformHeight + 0.03, -y]);
      
      lastX = x2;
      y += platformStepSize;
      direction *= -1;
      passCount++;
    }
    
    // Доводим до самого края площадки перед опуском на ступени
    const finalPlatformZ = -(platformLength - margin);
    const lastPlatformPoint = points[points.length - 1];

    // Если мы не у края (или площадки нет вовсе), доводим кабель до края площадки
    if (!lastPlatformPoint || Math.abs(lastPlatformPoint[2] - finalPlatformZ) > 0.01) {
      points.push([lastX, platformHeight + 0.03, finalPlatformZ]);
    }

    
    // СТУПЕНИ (змейкой, спускаемся вниз)
    for (let i = 0; i < stepCount; i++) {
      const stepZ = -(platformLength + i * stepWidth);
      const stepY = platformHeight - ((i + 1) * 0.15);
      const threadSpacing = stepWidth / (threadsPerStep + 1);
      
      // Вертикальный опуск с предыдущей поверхности
      const prevZ = points[points.length - 1]?.[2] ?? -(platformLength - margin);
      const firstThreadZ = stepZ - threadSpacing;
      
      // Опускаемся по вертикали и горизонтали до первой нитки
      points.push([lastX, platformHeight - (i * 0.15) + 0.03, prevZ]); // Начало опуска (на высоте предыдущей ступени или площадки)
      points.push([lastX, stepY + 0.03, prevZ]); // Опустились вниз
      points.push([lastX, stepY + 0.03, firstThreadZ]); // Дошли до первой нитки
      
      // Определяем начальное направление на основе текущей X
      let currentDirection = (lastX < stepLength / 2) ? 1 : -1;
      
      for (let thread = 1; thread <= threadsPerStep; thread++) {
        const offsetZ = stepZ - (thread * threadSpacing);
        const x2 = currentDirection === 1 ? stepLength - margin : margin;
        
        // Горизонтальная линия вдоль ступени
        points.push([x2, stepY + 0.03, offsetZ]);
        lastX = x2;
        
        // Вертикальный переход к следующей нитке (если не последняя)
        if (thread < threadsPerStep) {
          const nextOffsetZ = stepZ - ((thread + 1) * threadSpacing);
          points.push([x2, stepY + 0.03, nextOffsetZ]);
        }
        
        currentDirection *= -1;
      }
    }
    
    return points;
  };

  const cablePoints = generateAllCablePoints();

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Визуализация</CardTitle>
        <CardDescription>Трёхмерная модель раскладки кабеля (можно вращать мышью)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[500px] border border-border rounded-lg overflow-hidden bg-muted/20">
          <Canvas>
            <PerspectiveCamera makeDefault position={[platformWidth * 1.5, platformLength * 0.8, platformLength * 1.2]} />
            <OrbitControls enableDamping dampingFactor={0.05} />
            
            {/* Освещение */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.5} />

            {/* Площадка (сверху) */}
            <mesh position={[platformWidth / 2, platformHeight, -platformLength / 2]} receiveShadow>
              <boxGeometry args={[platformWidth, 0.05, platformLength]} />
              <meshStandardMaterial color="#e5e7eb" />
            </mesh>

            {/* Ступени (спускаются вниз от площадки) */}
            {Array.from({ length: stepCount }).map((_, i) => (
              <group key={i}>
                {/* Проступь (горизонтальная часть) */}
                <mesh 
                  position={[
                    stepLength / 2, 
                    platformHeight - ((i + 1) * 0.15), 
                    -(platformLength + i * stepWidth + stepWidth / 2)
                  ]} 
                  receiveShadow
                >
                  <boxGeometry args={[stepLength, 0.05, stepWidth]} />
                  <meshStandardMaterial color="#d1d5db" />
                </mesh>
                
                {/* Подступенок (вертикальная часть) */}
                <mesh 
                  position={[
                    stepLength / 2, 
                    platformHeight - ((i + 1) * 0.15) - 0.075, 
                    -(platformLength + (i + 1) * stepWidth)
                  ]} 
                  receiveShadow
                >
                  <boxGeometry args={[stepLength, 0.15, 0.05]} />
                  <meshStandardMaterial color="#9ca3af" />
                </mesh>
              </group>
            ))}

            {/* Кабель (сплошная змейка) */}
            {cablePoints.length > 1 && (
              <Line
                points={cablePoints}
                color="#3b82f6"
                lineWidth={5}
                dashed={false}
              />
            )}

            {/* Сетка для ориентации */}
            <gridHelper args={[Math.max(platformWidth, platformLength + stepCount * stepWidth) * 1.5, 20, "#94a3b8", "#cbd5e1"]} />
          </Canvas>

          {/* Кнопка сброса камеры */}
          <Button
            onClick={() => window.location.reload()}
            size="sm"
            variant="secondary"
            className="absolute top-4 right-4 gap-2 shadow-lg"
          >
            <RotateCcw className="h-4 w-4" />
            Сбросить вид
          </Button>
        </div>

        {/* Подсказка */}
        <div className="mt-4 text-sm text-muted-foreground text-center">
          💡 Используйте мышь для вращения модели, колесико для масштабирования
        </div>
      </CardContent>
    </Card>
  );
};

export default CableLayout3D;
